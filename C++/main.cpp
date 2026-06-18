#include <iostream>
#include <string>
#include <string_view>
#include <vector>
#include <iterator>
using namespace std;

/*int main() {
	cout << "Enter two numbers seperated by space: ";

	int x {};
	int y {};

	cin >> x >> y;

	cout << "The number you enter is : " << x << " and " << y; 
	return 0;
}*/

/* string view eliminates the need for multiple copies across the function's initialization and main's initialization 
by providing a read only access to an existing string
void printSV(string_view str){
	cout << str << '\n';
}

int main(){

	cout << "Choose a num";
	int nums {};
	cin >> nums;

	cout << "Enter your name";
	string name {};
	getline(cin >> ws, name);

	cout << "Fuck you" << name << "your choice is: " << nums << '\n';

	return 0;

}

*/

/*
template <typename T>
void passByRef(const ::vector<T>& arr, int index){

	if (index < 0 || index >= static_cast<int>(arr.size()))
		cout << "Invalid index\n";
	else
		cout << "The value is: " << arr[static_cast<::size_t>(index)] << '\n';

	cout << arr[0] << '\n';
}

int main(){
	::vector primes{3, 2, 5};
	passByRef(primes, 4);

	return 0;
}
*/


/*#include <cassert>

void fizzBuss(int count){
	static const ::vector divisors {3, 5, 7, 11 ,13, 17, 19};
	static const ::vector<::string_view> words {"fizz", "buzz", "pop", "bang", "jazz", "pow", "boom" };

	assert(::size(divisors) == ::size(words) && "Array size mismatch");

	for(int i{1}; i <= count; ++i){

		bool printed {false};

		for(::size_t j{0}; j < divisors.size(); ++j){
			if (i % divisors[j] == 0){
				cout << words[j] << '\n';
				printed = true;
			}
		}

		if (!printed)
			cout << i << '\n';

	}
}

int main(){
	fizzBuss(10);
	return 0;
}

*/

/*template<typename T>
void printArray(const ::vector<T>& arr){

	for(::size_t index {0}; index < arr.size(); ++index){
		cout << arr[index] << " ";
	}

	if (arr.size() > 0){
		cout << '\n';
	}
}

int main(){
	::vector arr{ 4, 6, 7, 3, 8, 2, 1, 9 };

    printArray(arr); // use function template to print array

    return 0;
}

*/

#include "Point3d.h"
#include "Vector3d.h"

int main(){
	Vector v {2.0, 5.0, 4.0};
	Point p {1.0, 3.0, 6.0};

	p.print();
	p.moveByVector(v);
	p.print();

	return 0;

}
